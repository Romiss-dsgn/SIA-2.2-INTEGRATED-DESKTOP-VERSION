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

  // ══════════════════════════════════════════════════════════════════════
  // ✅ CLAUDE AI — Clinical Interpretation via Anthropic API
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Calls the Claude API with a clinical prompt and returns a short
   * interpretation string (e.g. "✅ Normal heart rate – 72 bpm is within
   * the healthy adult range of 60–100 bpm.").
   *
   * debounce + AbortController are used so rapid keystrokes don't spam
   * the API.  A cache avoids re-calling for the same value.
   */
  const _aiCache = new Map();

  async function getAIStatus(type, value, extraContext = "") {
    if (!value || isNaN(parseFloat(value))) return null;

    const cacheKey = `${type}:${value}:${extraContext}`;
    if (_aiCache.has(cacheKey)) return _aiCache.get(cacheKey);

    const prompts = {
      heartrate: `You are a clinical assistant. A patient's heart rate is ${value} bpm. ${extraContext}
Give a single-line clinical interpretation (max 15 words). Start with an emoji status indicator:
✅ for normal, ⚠️ for mild concern, 🔴 for moderate concern, 🚨 for urgent.
Only output the one-line interpretation. No extra text.`,

      temperature: `You are a clinical assistant. A patient's body temperature is ${value}°C. ${extraContext}
Give a single-line clinical interpretation (max 15 words). Start with an emoji:
✅ normal, 🥶 hypothermia, 🌡️ low-grade fever, 🔥 fever, 🚨 high fever / urgent.
Only output the one-line interpretation. No extra text.`,

      bloodpressure: `You are a clinical assistant. A patient's blood pressure is ${value} mmHg. ${extraContext}
Give a single-line clinical interpretation (max 15 words) using AHA classification. Start with an emoji:
✅ normal, 🟡 elevated, 🟠 Stage 1 hypertension, 🔴 Stage 2 hypertension, 🚨 hypertensive crisis, 🔵 hypotension.
Only output the one-line interpretation. No extra text.`,
    };

    const prompt = prompts[type];
    if (!prompt) return null;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 60,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      const text = data?.content?.[0]?.text?.trim() ?? null;
      if (text) _aiCache.set(cacheKey, text);
      return text;
    } catch {
      return null;
    }
  }

  /** Simple debounce helper */
  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  /**
   * Picks a display color from the leading emoji of the AI response.
   */
  function colorFromEmoji(text) {
    if (!text) return "#64748b";
    if (text.startsWith("✅")) return "#059669";
    if (text.startsWith("🥶") || text.startsWith("🔵")) return "#3b82f6";
    if (text.startsWith("🌡️") || text.startsWith("🟡")) return "#f59e0b";
    if (text.startsWith("⚠️") || text.startsWith("🟠")) return "#f97316";
    if (text.startsWith("🔴")) return "#ef4444";
    if (text.startsWith("🚨")) return "#dc2626";
    return "#64748b";
  }

  // ── Fallback (instant, offline) status helpers ──────────────────────
  function getHRStatus(val) {
    const n = parseFloat(val);
    if (isNaN(n)) return null;
    if (n < 60)   return { text: "⚠️ Bradycardia – Below normal range",  color: "#f59e0b" };
    if (n <= 100) return { text: "✅ Normal heart rate",                  color: "#059669" };
    return              { text: "⚠️ Tachycardia – Above normal range",   color: "#ef4444" };
  }
  function getTempStatus(val) {
    const n = parseFloat(val);
    if (isNaN(n)) return null;
    if (n < 36.0)  return { text: "🥶 Hypothermia – Critically low temperature",  color: "#3b82f6" };
    if (n <= 37.2) return { text: "✅ Normal – No fever detected",                 color: "#059669" };
    if (n <= 37.9) return { text: "🌡️ Low-grade Fever – Mild elevation",           color: "#f59e0b" };
    if (n <= 38.9) return { text: "🔥 Fever – Patient has fever",                  color: "#f97316" };
    return               { text: "🔥 High Fever – Requires immediate attention",  color: "#dc2626" };
  }
  function getBMIStatus(val) {
    const n = parseFloat(val);
    if (isNaN(n)) return null;
    if (n < 18.5) return { text: `BMI ${n.toFixed(1)} — Underweight`,      color: "#3b82f6" };
    if (n < 25.0) return { text: `BMI ${n.toFixed(1)} — ✅ Normal weight`, color: "#059669" };
    if (n < 30.0) return { text: `BMI ${n.toFixed(1)} — ⚠️ Overweight`,   color: "#f59e0b" };
    return              { text: `BMI ${n.toFixed(1)} — ⚠️ Obese`,         color: "#ef4444" };
  }
  function getBPStatus(val) {
    if (!val) return null;
    const match = String(val).match(/(\d+\.?\d*)\s*\/\s*(\d+\.?\d*)/);
    if (!match) return null;
    const s = parseFloat(match[1]), d = parseFloat(match[2]);
    if (s > 180 || d > 120) return { text: "🚨 Hypertensive Crisis – Seek emergency care immediately", color: "#dc2626" };
    if (s >= 140 || d >= 90) return { text: "🔴 High BP Stage 2 – Consult a doctor",                  color: "#ef4444" };
    if ((s >= 130 && s <= 139) || (d >= 80 && d <= 89)) return { text: "🟠 High BP Stage 1 – Monitor closely", color: "#f97316" };
    if (s >= 120 && s <= 129 && d < 80) return { text: "🟡 Elevated – Lifestyle changes recommended",  color: "#f59e0b" };
    if (s < 90 || d < 60) return { text: "🔵 Hypotension – Blood pressure is low",                     color: "#3b82f6" };
    return { text: "✅ Normal blood pressure", color: "#059669" };
  }
  function getHeightConvert(val) {
    const cm = parseFloat(val);
    if (isNaN(cm) || cm <= 0) return null;
    const totalInches = cm / 2.54;
    const feet  = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { text: `≈ ${feet}ft ${inches}in  (${totalInches.toFixed(1)} inches)` };
  }
  function statusBadge(status, extraColor) {
    if (!status) return "";
    const color = extraColor || status.color || "#64748b";
    return `<span class="text-xs font-semibold mt-1 block" style="color:${color}">${status.text}</span>`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Load existing vital sign records
  // ══════════════════════════════════════════════════════════════════════
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
                ${statusBadge(getHRStatus(v.heartrate))}
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Temperature</label>
                <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${v.temp || "—"}</div>
                ${statusBadge(getTempStatus(v.temp))}
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Weight</label>
                <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${v.weight || "—"}</div>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Height</label>
                <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${v.height || "—"}</div>
                ${(() => { const h = getHeightConvert(v.height); return h ? `<span class="text-xs font-semibold mt-1 block" style="color:#64748b">${h.text}</span>` : ""; })()}
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Blood Pressure</label>
                <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${v.pressure || "—"}</div>
                ${statusBadge(getBPStatus(v.pressure))}
              </div>
            </div>
            <div class="grid grid-cols-1 gap-4">
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">BMI</label>
                <div class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800">${v.bmi || "—"}</div>
                ${statusBadge(getBMIStatus(v.bmi))}
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

  // ══════════════════════════════════════════════════════════════════════
  // Add new record form
  // ══════════════════════════════════════════════════════════════════════
  function attachAddBtnListener() {
    const addBtn = document.getElementById("addVitalBtn");
    if (!addBtn) return;

    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (document.querySelector(".newRecord")) return;

      const newCard = document.createElement("div");
      newCard.className = "medecineCon newRecord bg-slate-50 border border-slate-200 rounded-xl p-5 mb-4";

      // ✅ Weight & Height are now side-by-side (same grid cell group)
      newCard.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-bold text-primary">New Vital Sign Record</h3>
        </div>
        <form id="vitalForm" class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">

          <!-- Date -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</label>
            <input type="date" name="date" required
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>

          <!-- Heart Rate -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Heart Rate</label>
            <div class="relative">
              <input type="number" id="hrInput" name="heartrate" placeholder="e.g. 75" min="1" max="300" required
                class="w-full px-4 py-2.5 pr-14 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none select-none">bpm</span>
            </div>
            <span id="hrStatus" class="text-xs font-semibold mt-0.5 min-h-[1rem]" style="display:none;"></span>
          </div>

          <!-- Temperature -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Temperature (°C)</label>
            <input type="number" id="tempInput" name="temp" placeholder="e.g. 36.5" step="0.1" min="30" max="45" required
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            <span id="tempStatus" class="text-xs font-semibold mt-0.5 min-h-[1rem]" style="display:none;"></span>
          </div>

          <!-- ✅ Weight & Height — side by side, spans 2 columns -->
          <div class="col-span-2 md:col-span-2 grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Weight (kg)</label>
              <input type="number" id="weightInput" name="weight" placeholder="e.g. 65" step="0.1" min="1" required
                class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Height (cm)</label>
              <input type="number" id="heightInput" name="height" placeholder="e.g. 170" step="0.1" min="1" required
                class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              <span id="heightConvert" class="text-xs font-semibold mt-0.5 text-slate-400" style="display:none;"></span>
            </div>
          </div>

          <!-- Blood Pressure — split Systolic / Diastolic -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Blood Pressure</label>
            <div class="flex items-center gap-2">
              <input type="number" id="systolicInput" name="systolic" placeholder="Systolic" min="40" max="300" required
                class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              <span class="text-slate-400 font-bold text-base select-none">/</span>
              <input type="number" id="diastolicInput" name="diastolic" placeholder="Diastolic" min="20" max="200" required
                class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              <span class="text-xs font-bold text-slate-400 whitespace-nowrap select-none">mmHg</span>
            </div>
            <span id="bpStatus" class="text-xs font-semibold mt-0.5 min-h-[1rem]" style="display:none;"></span>
            <input type="hidden" id="pressureHidden" name="pressure" />
          </div>

          <!-- BMI — auto-calculated, readonly -->
          <div class="flex flex-col gap-1 col-span-2 md:col-span-3">
            <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              BMI <span class="normal-case font-normal text-slate-400">(auto-calculated from Weight &amp; Height)</span>
            </label>
            <input type="text" id="bmiInput" name="bmi" placeholder="Calculated automatically from Weight and Height" readonly
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-100 text-sm text-slate-800 cursor-not-allowed" />
            <span id="bmiStatus" class="text-xs font-semibold mt-0.5" style="display:none;"></span>
          </div>

        </form>
      `;

      vitalSignsContainer.appendChild(newCard);
      buttonCon.style.display = "flex";
      addBtn.style.display = "none";

      // ── Heart Rate: AI + fallback ──────────────────────────────────
      const hrInput  = document.getElementById("hrInput");
      const hrStatus = document.getElementById("hrStatus");

      const updateHRStatus = debounce(async () => {
        const val = hrInput.value;
        if (!val || isNaN(parseFloat(val))) { hrStatus.style.display = "none"; return; }

        // Show instant fallback first
        const fallback = getHRStatus(val);
        if (fallback) {
          hrStatus.textContent   = fallback.text;
          hrStatus.style.color   = fallback.color;
          hrStatus.style.display = "block";
        }

        // Then upgrade with AI
        const aiText = await getAIStatus("heartrate", val);
        if (aiText) {
          hrStatus.textContent   = aiText;
          hrStatus.style.color   = colorFromEmoji(aiText);
          hrStatus.style.display = "block";
        }
      }, 800);

      hrInput.addEventListener("input", updateHRStatus);

      // ── Temperature: AI + fallback ─────────────────────────────────
      const tempInput  = document.getElementById("tempInput");
      const tempStatus = document.getElementById("tempStatus");

      const updateTempStatus = debounce(async () => {
        const val = tempInput.value;
        if (!val || isNaN(parseFloat(val))) { tempStatus.style.display = "none"; return; }

        const fallback = getTempStatus(val);
        if (fallback) {
          tempStatus.textContent   = fallback.text;
          tempStatus.style.color   = fallback.color;
          tempStatus.style.display = "block";
        }

        const aiText = await getAIStatus("temperature", val);
        if (aiText) {
          tempStatus.textContent   = aiText;
          tempStatus.style.color   = colorFromEmoji(aiText);
          tempStatus.style.display = "block";
        }
      }, 800);

      tempInput.addEventListener("input", updateTempStatus);

      // ── BMI: auto-calculate from Weight & Height ───────────────────
      const weightInput = document.getElementById("weightInput");
      const heightInput = document.getElementById("heightInput");
      const bmiInput    = document.getElementById("bmiInput");
      const bmiStatus   = document.getElementById("bmiStatus");

      function calcBMI() {
        const w = parseFloat(weightInput.value);
        const h = parseFloat(heightInput.value);
        if (!w || !h || h <= 0) {
          bmiInput.value          = "";
          bmiStatus.style.display = "none";
          return;
        }
        const bmi = w / Math.pow(h / 100, 2);
        bmiInput.value = bmi.toFixed(1);
        const s = getBMIStatus(bmi.toFixed(1));
        if (s) {
          bmiStatus.textContent   = s.text;
          bmiStatus.style.color   = s.color;
          bmiStatus.style.display = "block";
        }
      }

      weightInput.addEventListener("input", calcBMI);
      heightInput.addEventListener("input", calcBMI);

      // ── Height: live cm → ft & in conversion ──────────────────────
      const heightConvert = document.getElementById("heightConvert");
      heightInput.addEventListener("input", () => {
        const cm = parseFloat(heightInput.value);
        if (!heightInput.value || isNaN(cm) || cm <= 0) {
          heightConvert.style.display = "none"; return;
        }
        const h = getHeightConvert(cm);
        if (h) {
          heightConvert.textContent   = h.text;
          heightConvert.style.display = "block";
        }
      });

      // ── Blood Pressure: AI + fallback AHA classification ──────────
      const systolicInput  = document.getElementById("systolicInput");
      const diastolicInput = document.getElementById("diastolicInput");
      const pressureHidden = document.getElementById("pressureHidden");
      const bpStatus       = document.getElementById("bpStatus");

      const updateBPStatus = debounce(async () => {
        const s = parseFloat(systolicInput.value);
        const d = parseFloat(diastolicInput.value);
        const hasS = systolicInput.value !== "" && !isNaN(s);
        const hasD = diastolicInput.value !== "" && !isNaN(d);

        if (hasS && hasD) {
          pressureHidden.value = `${s}/${d} mmHg`;
        } else if (hasS) {
          pressureHidden.value = `${s}/— mmHg`;
        } else {
          pressureHidden.value = "";
        }

        if (!hasS || !hasD) { bpStatus.style.display = "none"; return; }

        const bpVal = `${s}/${d}`;

        // Instant fallback
        const fallback = getBPStatus(bpVal);
        if (fallback) {
          bpStatus.textContent   = fallback.text;
          bpStatus.style.color   = fallback.color;
          bpStatus.style.display = "block";
        }

        // AI upgrade
        const aiText = await getAIStatus("bloodpressure", bpVal);
        if (aiText) {
          bpStatus.textContent   = aiText;
          bpStatus.style.color   = colorFromEmoji(aiText);
          bpStatus.style.display = "block";
        }
      }, 800);

      systolicInput.addEventListener("input", updateBPStatus);
      diastolicInput.addEventListener("input", updateBPStatus);
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

    const raw = Object.fromEntries(new FormData(form).entries());

    // ✅ Format values with proper units before saving
    const data = {
      date:      raw.date,
      heartrate: raw.heartrate ? `${raw.heartrate} bpm` : raw.heartrate,
      temp:      raw.temp      ? `${raw.temp}°C`         : raw.temp,
      weight:    raw.weight    ? `${raw.weight} kg`      : raw.weight,
      height:    raw.height    ? `${raw.height} cm`      : raw.height,
      pressure:  raw.pressure  || "",   // already "120/80 mmHg" from hidden field
      bmi:       raw.bmi       || "",
    };

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