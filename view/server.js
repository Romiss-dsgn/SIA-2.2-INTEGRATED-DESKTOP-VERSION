// =========================
// SERVER.JS (ES MODULE VERSION)
// =========================
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";
import Notification from "./models/NotificationModel.js";

dotenv.config();

function buildBillingUrl(path) {
  const base = process.env.BILLING_URL;
  if (!base) return null;
  try {
    return new URL(path, base).toString();
  } catch (err) {
    console.warn("Invalid BILLING_URL provided:", base);
    return null;
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// =========================
// SAFE MODEL IMPORTS
// =========================
import AppointmentModel from "./models/AppointmentModel.js";
import PatientModel from "./models/PatientModel.js";
import UserModel from "./models/UserModel.js";
import MedicineModel from "./models/MedicineModel.js";
import PrescribeModel from "./models/PrescribeModel.js";

export { PatientModel, UserModel, MedicineModel, AppointmentModel, PrescribeModel };

// --- ROUTES ---
import pharmacyRoutes from "./routes/pharmacyRoutes.js";
app.use("/api/pharmacydb", pharmacyRoutes);

import integrationRoutes from "./routes/integrationRoutes.js";
app.use("/api/integration", integrationRoutes);

import pharmacyIntegrationTest from "./routes/pharmacyIntegrationTest.js";
app.use("/api/settings", pharmacyIntegrationTest);

import billingRoutes from "./routes/billingIntegration.js";
app.use("/api/integrations", billingRoutes);

import medicationIntegrationRoutes from "./routes/medicationIntegration.js";
app.use("/api/medication-integration", medicationIntegrationRoutes);

// ====== CONNECT TO MONGODB (single connection) ======
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ====== SINGLE mongoose.connection.once handler ======
mongoose.connection.once("open", async () => {
  // Drop old index
  try {
    await mongoose.connection.db.collection("patients").dropIndex("patientid_1");
    console.log("✅ Dropped old patientid_1 index");
  } catch (err) {
    console.log("ℹ No old index to drop");
  }

  // Migrate patientid → patientId
  try {
    const oldPatients = await mongoose.connection.db.collection("patients").find({}).toArray();
    for (const patient of oldPatients) {
      if (patient.patientid && !patient.patientId) {
        await mongoose.connection.db.collection("patients").updateOne(
          { _id: patient._id },
          { $set: { patientId: patient.patientid }, $unset: { patientid: "" } }
        );
      }
    }
    if (oldPatients.length > 0) {
      console.log(`✅ Migrated ${oldPatients.length} patients to camelCase`);
    }
  } catch (err) {
    console.log("Migration error:", err.message);
  }

  // Fix patient statuses
  try {
    const result = await mongoose.connection.db.collection("patients").updateMany(
      { $or: [{ status: { $exists: false } }, { status: null }, { status: "" }, { status: "active" }] },
      { $set: { status: "Active" } }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ Set default status for ${result.modifiedCount} patients`);
    }
  } catch (err) {
    console.log("Status update error:", err.message);
  }

  // Initialize backup scheduler
  try {
    const defaultSettings = {
      appointment: { frequency: 1, unit: "days" },
      account: { frequency: 1, unit: "days" },
      activity: { frequency: 7, unit: "days" },
    };
    scheduleBackups(defaultSettings);
    console.log("✅ Backup scheduler initialized");
  } catch (err) {
    console.error("❌ Failed to initialize backup scheduler:", err);
  }
});

// ====== LIVE TOGGLES ======
let integrationStatus = {
  emr: process.env.ENABLE_EMR_API === "true",
  billing: process.env.ENABLE_BILLING_API === "true",
  pharmacy: process.env.ENABLE_PHARMACY_API === "true",
};

app.get("/api/integration/status", (req, res) => res.json(integrationStatus));

app.post("/api/integration/status", (req, res) => {
  const { emr, billing, pharmacy } = req.body;
  integrationStatus.emr = !!emr;
  integrationStatus.billing = !!billing;
  integrationStatus.pharmacy = !!pharmacy;
  console.log("Updated integration status:", integrationStatus);
  res.json({ success: true, integrationStatus });
});

// ====== EMR PRESCRIPTION SAVE ======
app.post("/api/prescriptions", async (req, res) => {
  const prescription = req.body;
  if (integrationStatus.pharmacy) {
    try {
      await fetch(process.env.PHARMACY_URL + "/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.PHARMACY_API_KEY },
        body: JSON.stringify(prescription),
      });
      console.log("✅ Prescription sent to Pharmacy");
    } catch (err) {
      console.error("❌ Failed to send to Pharmacy:", err.message);
    }
  }
  if (integrationStatus.billing) {
    const billingUrl = buildBillingUrl("/api/billing");
    if (!billingUrl) {
      console.warn("⚠️ BILLING_URL not set or invalid — skipping billing send for prescription");
    } else {
      try {
        await fetch(billingUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": process.env.BILLING_API_KEY },
          body: JSON.stringify(prescription),
        });
        console.log("✅ Billing info sent to Billing System");
      } catch (err) {
        console.error("❌ Failed to send to Billing:", err.message);
      }
    }
  }
  res.json({ success: true });
});

// ====== USER SCHEMA ======
const userSchema = new mongoose.Schema({
  userId: String,
  name: String,
  email: { type: String, unique: true, lowercase: true, trim: true },
  password: String,
  role: { type: String, enum: ["Admin", "Doctor", "Nurse", "Medtech"] },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  lastLogin: { type: Date, default: null },
});
const User = mongoose.model("User", userSchema);
const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizeRole = (role = "") => {
  const trimmed = String(role || "").trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

async function resolveRecipientUserId(recipientId) {
  const rawId = String(recipientId || "").trim();
  if (!rawId) return null;

  const conditions = [{ userId: rawId }];
  if (mongoose.Types.ObjectId.isValid(rawId)) {
    conditions.push({ _id: rawId });
  }

  const user = await User.findOne({ $or: conditions }, { userId: 1 }).lean();
  return user?.userId || rawId;
}

// ====== ARCHIVE SCHEMA ======
const archiveSchema = new mongoose.Schema({
  userId: String,
  name: String,
  email: String,
  role: String,
  status: String,
  lastLogin: Date,
  archivedOn: { type: Date, default: Date.now },
});
const Archive = mongoose.model("Archive", archiveSchema);

// ====== ACTIVITY LOG SCHEMA ======
const activityLogSchema = new mongoose.Schema({
  logId: { type: String, unique: true },
  userId: String,
  userName: String,
  userRole: String,
  action: String,
  details: String,
  ipAddress: String,
  loginTime: Date,
  logoutTime: Date,
  duration: String,
  timestamp: { type: Date, default: Date.now },
});
const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

async function generateActivityLogId() {
  const last = await ActivityLog.findOne().sort({ _id: -1 });
  if (!last) return "AL001";
  const num = parseInt(last.logId.replace("AL", "")) + 1;
  return "AL" + num.toString().padStart(3, "0");
}

// ====== HELPER: Generate UserId ======
async function generateUserId(role) {
  let prefix = "";
  if (role === "Admin") prefix = "A";
  else if (role === "Doctor") prefix = "D";
  else if (role === "Nurse") prefix = "N";
  else if (role === "Medtech") prefix = "M";
  const count = await User.countDocuments({ role });
  const number = String(count + 1).padStart(3, "0");
  return `${prefix}${number}`;
}

const activeSessions = new Map();

// ====== LOGIN ======
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid email and password." });

  if (user.status === "Inactive") {
    return res.status(403).json({ message: "Your account is inactive. Please contact an administrator." });
  }

  const isTempPassword = await bcrypt.compare("Temp@123", user.password);
  user.lastLogin = new Date();
  await user.save();

  try {
    const logId = await generateActivityLogId();
    const loginTime = new Date();
    const activityLog = new ActivityLog({
      logId,
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      action: "Login",
      details: `User logged in successfully`,
      ipAddress: req.ip || req.connection.remoteAddress || "Unknown",
      loginTime,
      timestamp: loginTime,
    });
    await activityLog.save();
    activeSessions.set(user.userId, { sessionLogId: logId, loginTime });
    console.log(`✅ Login activity logged for ${user.name} with ID: ${logId}`);
    res.json({
      message: "Login success",
      role: user.role,
      name: user.name,
      email: user.email,
      userId: user.userId,
      status: user.status,
      sessionLogId: logId,
      requiresReset: isTempPassword,
    });
  } catch (err) {
    console.error("❌ Error logging login activity:", err);
    res.status(500).json({ message: "Login error" });
  }
});

app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!email || !newPassword) return res.status(400).json({ message: "Email and new password are required" });
    if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: "User not found" });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "✅ Password reset successfully" });
  } catch (err) {
    console.error("Error resetting password:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/users/verify-password", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!email || !password) return res.status(400).json({ valid: false, message: "Email and password are required" });
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ valid: false, message: "User not found" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch && user.role === "Admin") {
      res.json({ valid: true, message: "Password verified" });
    } else {
      res.status(401).json({ valid: false, message: "Invalid credentials or not an admin" });
    }
  } catch (error) {
    console.error("Password verification error:", error);
    res.status(500).json({ valid: false, message: "Server error" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { userId, password, action } = req.body;
    if (action === "verify") {
      if (!userId || !password) return res.status(400).json({ message: "Missing Admin ID or password for verification." });
      const adminUser = await User.findOne({ userId });
      if (!adminUser || adminUser.role !== "Admin") return res.status(401).json({ message: "Unauthorized: Invalid credentials or role." });
      const isMatch = await bcrypt.compare(password, adminUser.password);
      if (isMatch) return res.status(200).json({ message: "✅ Admin verified successfully" });
      else return res.status(401).json({ message: "Incorrect Admin Password." });
    }
    const { name, email, role: userRole, password: userPassword } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!userRole || !name || !email || !userPassword) return res.status(400).json({ message: "Missing required fields for new user creation." });
    if (!["Doctor", "Nurse", "Medtech"].includes(userRole)) return res.status(400).json({ message: "Only Doctor, Nurse, or Medtech accounts can be added" });
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ message: "Email already exists" });
    const hashedPassword = await bcrypt.hash(userPassword, 10);
    const newUserId = await generateUserId(userRole);
    const newUser = new User({ userId: newUserId, name, email: normalizedEmail, password: hashedPassword, role: userRole, status: "Active", lastLogin: null });
    await newUser.save();
    res.json({ message: "✅ User added successfully", user: newUser });
  } catch (err) {
    console.error("Error processing user API request:", err);
    res.status(500).json({ message: "Server error or Database connection failure." });
  }
});

app.post("/api/logout", async (req, res) => {
  try {
    const { sessionLogId, userId } = req.body;
    if (!sessionLogId) return res.status(400).json({ message: "Session log ID required" });
    const activityLog = await ActivityLog.findOne({ logId: sessionLogId });
    if (!activityLog) return res.status(404).json({ message: "Activity log not found" });
    const logoutTime = new Date();
    const loginTime = activityLog.loginTime || activityLog.timestamp;
    const durationMs = logoutTime - loginTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    const durationStr = hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
    activityLog.action = "Logout";
    activityLog.logoutTime = logoutTime;
    activityLog.duration = durationStr;
    activityLog.details = `User logged out after ${durationStr}`;
    await activityLog.save();
    if (userId) activeSessions.delete(userId);
    console.log(`✅ Logout logged for ${activityLog.userName} - Duration: ${durationStr}`);
    res.json({ message: "✅ Logout successful", duration: durationStr });
  } catch (err) {
    console.error("❌ Error logging logout:", err);
    res.status(500).json({ message: "Error logging logout" });
  }
});

app.post("/api/session/validate", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ valid: false, message: "User ID required" });
    const user = await User.findOne({ userId });
    if (!user) {
      activeSessions.delete(userId);
      return res.status(401).json({ valid: false, forceLogout: true, reason: "deleted", message: "Your account has been deleted. You will be logged out." });
    }
    if (user.status === "Inactive") {
      activeSessions.delete(userId);
      return res.status(401).json({ valid: false, forceLogout: true, reason: "inactive", message: "Your account has been deactivated. You will be logged out." });
    }
    if (!activeSessions.has(userId)) {
      return res.status(401).json({ valid: false, forceLogout: true, reason: "no_session", message: "Your session has expired. Please log in again." });
    }
    res.json({ valid: true });
  } catch (err) {
    console.error("❌ Error validating session:", err);
    res.status(500).json({ valid: false, message: "Error validating session" });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    activeSessions.delete(user.userId);
    const archivedUser = new Archive({ userId: user.userId, name: user.name, email: user.email, role: user.role, status: user.status, lastLogin: user.lastLogin });
    await archivedUser.save();
    await user.deleteOne();
    res.json({ message: "🗑️ User archived successfully", forceLogout: true, userId: user.userId });
  } catch (err) {
    res.status(400).json({ message: "Error archiving user", error: err.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const { name, email, status, password } = req.body;
    const updateData = { name, email, status };
    let passwordChanged = false;
    if (password && password.trim() !== "") {
      updateData.password = await bcrypt.hash(password, 10);
      passwordChanged = true;
    }
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true, fields: "-password" });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (passwordChanged || status === "Inactive") {
      activeSessions.delete(user.userId);
    }
    res.json({ message: "✅ User updated successfully", user, forceLogout: passwordChanged || status === "Inactive", userId: user.userId, reason: passwordChanged ? "password_changed" : "inactive" });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

setInterval(async () => {
  try {
    for (const [userId] of activeSessions.entries()) {
      const user = await User.findOne({ userId });
      if (!user || user.status === "Inactive") {
        activeSessions.delete(userId);
        console.log(`🧹 Auto-removed session for ${userId}`);
      }
    }
  } catch (err) {
    console.error("Error in session cleanup:", err);
  }
}, 5000);

app.get("/api/archive", async (req, res) => {
  try {
    const archivedUsers = await Archive.find({});
    res.json(archivedUsers);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/archive/restore/:id", async (req, res) => {
  try {
    const archivedUser = await Archive.findById(req.params.id);
    if (!archivedUser) return res.status(404).json({ message: "Archived user not found" });
    const existingUser = await User.findOne({ email: archivedUser.email });
    if (existingUser) return res.status(400).json({ message: `Cannot restore: A user with email ${archivedUser.email} already exists in the system.` });
    const existingUserId = await User.findOne({ userId: archivedUser.userId });
    if (existingUserId) {
      archivedUser.userId = await generateUserId(archivedUser.role);
      console.log(`⚠️ UserID conflict. New ID: ${archivedUser.userId}`);
    }
    const tempPassword = await bcrypt.hash("Temp@123", 10);
    const restoredUser = new User({ userId: archivedUser.userId, name: archivedUser.name, email: archivedUser.email, password: tempPassword, role: archivedUser.role, status: archivedUser.status, lastLogin: archivedUser.lastLogin });
    await restoredUser.save();
    await archivedUser.deleteOne();
    res.json({ message: "✅ User restored successfully. Password reset required (Temp@123).", user: { userId: restoredUser.userId, name: restoredUser.name, email: restoredUser.email, role: restoredUser.role } });
  } catch (err) {
    console.error("❌ Error restoring user:", err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ message: `Cannot restore: ${field} already exists in the system.` });
    }
    res.status(500).json({ message: "Error restoring user", error: err.message });
  }
});

app.delete("/api/archive/:id", async (req, res) => {
  try {
    await Archive.findByIdAndDelete(req.params.id);
    res.json({ message: "❌ User permanently deleted" });
  } catch (err) {
    res.status(400).json({ message: "Error deleting archived user", error: err.message });
  }
});

// ====== PATIENT SCHEMA ======
const patientSchema = new mongoose.Schema({
  patientId: { type: String, unique: true },
  firstname: String,
  middlename: { type: String, default: null },
  lastname: String,
  dob: Date,
  gender: String,
  province: String,   // ADD THIS
  address: String,
  city: String,
  barangay: String,
  zipcode: String,
  email: String,
  phone: String,
  insurance: String,
  status: { type: String, default: "Active" },
  em_fullname: String,
  em_phone: String,
  relationship: String,
  em_email: String,
}, {
  timestamps: true
});
const Patient = mongoose.model("Patient", patientSchema);

// ====== ARCHIVED PATIENT SCHEMA ======
const archivedPatientSchema = new mongoose.Schema({
  patientId: { type: String, unique: true },
  firstname: String,
  middlename: { type: String, default: null },
  lastname: String,
  dob: Date,
  gender: String,
  province: String,
  address: String,
  city: String,
  barangay: String,
  zipcode: String,
  email: String,
  phone: String,
  insurance: String,
  status: { type: String, default: "Deceased" },
  em_fullname: String,
  em_phone: String,
  relationship: String,
  em_email: String,
}, {
  timestamps: true
});
const ArchivedPatient = mongoose.model("ArchivedPatient", archivedPatientSchema);

async function generatePatientId() {
  const [lastPatient, lastArchived] = await Promise.all([
    Patient.findOne().sort({ patientId: -1 }).lean(),
    ArchivedPatient.findOne().sort({ patientId: -1 }).lean()
  ]);

  const ids = [lastPatient?.patientId, lastArchived?.patientId].filter(Boolean);
  const maxNumber = ids.reduce((max, id) => {
    const num = parseInt((id || "").replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 0);

  const nextNumber = maxNumber + 1;
  return "P" + nextNumber.toString().padStart(3, '0');
}

app.get("/api/patients/fix-status", async (req, res) => {
  try {
    const result = await Patient.updateMany(
      { $or: [{ status: { $exists: false } }, { status: null }, { status: "" }] },
      { $set: { status: "Active" } }
    );
    res.json({ message: `✅ Updated ${result.modifiedCount} patients to Active status`, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error("Error updating statuses:", err);
    res.status(500).json({ message: "Error updating statuses" });
  }
});

app.get("/api/patients/fix-lowercase-status", async (req, res) => {
  try {
    const result = await Patient.updateMany({ status: "active" }, { $set: { status: "Active" } });
    res.json({ message: `✅ Updated ${result.modifiedCount} patients from "active" to "Active"`, modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: "Error updating statuses" });
  }
});

app.get("/api/patients/check-all", async (req, res) => {
  try {
    const allPatients = await Patient.find({});
    const report = allPatients.map((p) => ({ patientId: p.patientId, name: `${p.firstname} ${p.lastname}`, status: p.status, statusValue: JSON.stringify(p.status) }));
    res.json({ total: allPatients.length, patients: report });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

app.post("/api/patients", async (req, res) => {
  try {
    const newId = await generatePatientId();
    const patientData = {
      ...req.body,
      patientId: newId,
      createdAt: new Date(),
      status: req.body.status || "Active"
    };
    const patient = new Patient(patientData);
    await patient.save();
    console.log('✅ New patient registered:', {
      id: patient.patientId,
      name: `${patient.firstname} ${patient.lastname}`,
      createdAt: patient.createdAt
    });
    res.status(201).json({ message: "Patient registered successfully", patient });
  } catch (err) {
    console.error('❌ Error registering patient:', err);
    res.status(500).json({ message: "Error registering patient", error: err.message });
  }
});

app.get("/api/patients", async (req, res) => {
  try {
    const patients = await Patient.find();
    res.json(patients);
  } catch (err) {
    res.status(500).json({ message: "Error fetching patients" });
  }
});

app.get("/api/patients/:patientId", async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.patientId });
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: "Error fetching patient" });
  }
});

app.put("/api/patients/:patientId", async (req, res) => {
  try {
    const updatedPatient = await Patient.findOneAndUpdate({ patientId: req.params.patientId }, req.body, { new: true });
    if (!updatedPatient) return res.status(404).json({ message: "Patient not found" });
    res.json({ message: "✅ Patient information updated successfully", patient: updatedPatient });
  } catch (err) {
    res.status(500).json({ message: "Error updating patient" });
  }
});

app.post("/api/patients/auto-update-status", async (req, res) => {
  try {
    console.log("🔄 Starting auto-inactive patient status check...");
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    thirtyDaysFromNow.setHours(23, 59, 59, 999);
    const activePatients = await Patient.find({ status: "Active" });
    let updatedCount = 0;
    const updatedPatients = [];
    for (const patient of activePatients) {
      const recentAppointments = await Appointment.find({ patientId: patient.patientId, date: { $gte: thirtyDaysAgo, $lte: now } });
      const upcomingAppointments = await Appointment.find({ patientId: patient.patientId, date: { $gte: now, $lte: thirtyDaysFromNow } });
      const recentArchivedAppointments = await ArchiveAppointment.find({ patientId: patient.patientId, date: { $gte: thirtyDaysAgo, $lte: now } });
      const totalRecentAppointments = recentAppointments.length + recentArchivedAppointments.length;
      if (totalRecentAppointments === 0 && upcomingAppointments.length === 0) {
        patient.status = "Inactive";
        await patient.save();
        updatedCount++;
        updatedPatients.push({ patientId: patient.patientId, name: `${patient.firstname} ${patient.lastname}` });
      }
    }
    res.json({ success: true, message: `Auto-inactive check complete`, updatedCount, totalChecked: activePatients.length, updatedPatients });
  } catch (err) {
    console.error("❌ Error in auto-inactive check:", err);
    res.status(500).json({ success: false, message: "Error updating patient statuses", error: err.message });
  }
});

app.put("/api/patients/:patientId/archive", async (req, res) => {
  try {
    const { patientId } = req.params;
    const trimmedPatientId = patientId.trim();
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: "userId and password are required" });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    if (user.status !== "Active") {
      return res.status(401).json({ error: "User account is not active" });
    }
    const userRole = (user.role || "").toLowerCase();
    if (userRole !== "nurse") {
      return res.status(403).json({ error: "Only nurses can archive patients" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const patient = await Patient.findOne({ patientId: trimmedPatientId });
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // Check if already archived (avoid duplicate key error)
    const alreadyArchived = await ArchivedPatient.findOne({ patientId: trimmedPatientId });
    if (alreadyArchived) {
      // Already in archive — just remove from main collection
      await Patient.deleteOne({ patientId: trimmedPatientId });
      return res.json({ success: true, message: "Patient archive completed" });
    }

    // Strip MongoDB _id so it doesn't conflict
    const patientObj = patient.toObject();
    delete patientObj._id;

    const archivedPatient = new ArchivedPatient({
      ...patientObj,
      status: "Deceased"
    });
    await archivedPatient.save();

    await Patient.deleteOne({ patientId: trimmedPatientId });

    res.json({ success: true, message: "Patient archived successfully" });
  } catch (err) {
    console.error("Error archiving patient:", err);
    if (err.code === 11000) {
      // Duplicate key — patient already archived, just remove from main
      try {
        await Patient.deleteOne({ patientId: req.params.patientId.trim() });
        return res.json({ success: true, message: "Patient archive completed" });
      } catch (delErr) {
        return res.status(500).json({ error: "Duplicate archive error: " + delErr.message });
      }
    }
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

app.get("/api/patients/:patientId/appointment-summary", async (req, res) => {
  try {
    const { patientId } = req.params;
    const now = new Date();
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
    const thirtyDaysFromNow = new Date(now); thirtyDaysFromNow.setDate(now.getDate() + 30);
    const recentActive = await Appointment.find({ patientId, date: { $gte: thirtyDaysAgo, $lte: now } }).sort({ date: -1 }).limit(1);
    const recentArchived = await ArchiveAppointment.find({ patientId, date: { $gte: thirtyDaysAgo, $lte: now } }).sort({ date: -1 }).limit(1);
    const lastAppointment = [...recentActive, ...recentArchived].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const upcoming = await Appointment.find({ patientId, date: { $gte: now, $lte: thirtyDaysFromNow } }).sort({ date: 1 }).limit(1);
    res.json({
      patientId,
      lastAppointment: lastAppointment ? { date: lastAppointment.date, doctor: lastAppointment.doctorName, type: lastAppointment.type, daysAgo: Math.floor((now - new Date(lastAppointment.date)) / (1000 * 60 * 60 * 24)) } : null,
      nextAppointment: upcoming[0] ? { date: upcoming[0].date, doctor: upcoming[0].doctorName, type: upcoming[0].type, daysFromNow: Math.floor((new Date(upcoming[0].date) - now) / (1000 * 60 * 60 * 24)) } : null,
      totalRecentAppointments: recentActive.length + recentArchived.length,
      totalUpcomingAppointments: upcoming.length
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching appointment summary" });
  }
});

// ====== ARCHIVED PATIENTS ROUTES ======
app.get("/api/archived-patients", async (req, res) => {
  try {
    const archivedPatients = await ArchivedPatient.find().sort({ createdAt: -1 });
    res.json(archivedPatients);
  } catch (err) {
    console.error("Error fetching archived patients:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Single archived patient by patientId
app.get("/api/archived-patients/:patientId", async (req, res) => {
  try {
    const patient = await ArchivedPatient.findOne({ patientId: req.params.patientId });
    if (!patient) return res.status(404).json({ message: "Archived patient not found" });
    res.json(patient);
  } catch (err) {
    console.error("Error fetching archived patient:", err);
    res.status(500).json({ message: "Error fetching archived patient" });
  }
});

// ====== MEDICATION SCHEMA ======
const medicationSchema = new mongoose.Schema({
  medId: { type: String, unique: true },
  patientId: { type: String, required: true },
  appointmentId: { type: String },
  medicname: String, dosage: String, frequency: String,
  quantity: { type: Number, default: 0 },
  presby: String, presNotes: String,
  followup: Date, followupTime: String,
  isHistory: { type: Boolean, default: false },
  prescriptionDate: Date, prescriptionTime: String,
  duration: String, indication: String,
});
const Medication = mongoose.model("Medication", medicationSchema);

async function generateMedId() {
  const last = await Medication.findOne().sort({ _id: -1 });
  if (!last) return "M001";
  return "M" + (parseInt(last.medId.replace("M", "")) + 1).toString().padStart(3, "0");
}

app.post("/api/patients/:patientId/medications", async (req, res) => {
  try {
    const { patientId } = req.params;
    const newId = await generateMedId();
    const medication = new Medication({
      medId: newId, patientId,
      appointmentId: req.body.appointmentId || null,
      medicname: req.body.medicname, dosage: req.body.dosage,
      frequency: req.body.frequency, quantity: req.body.quantity,
      presby: req.body.presby, presNotes: req.body.presNotes,
      followup: req.body.followup ? new Date(req.body.followup) : null,
      followupTime: req.body.followupTime || null,
      isHistory: req.body.isHistory || false,
      duration: req.body.duration || "", indication: req.body.indication || "",
      prescriptionDate: new Date(),
      prescriptionTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
    await medication.save();
    res.status(201).json({ message: "✅ Medication saved successfully", medication });
  } catch (err) {
    console.error("❌ Error saving medication:", err);
    res.status(500).json({ message: "Error saving medication" });
  }
});

app.get("/api/patients/:patientId/medications", async (req, res) => {
  try {
    const { isHistory } = req.query;
    let query = { patientId: req.params.patientId };
    if (isHistory !== undefined) query.isHistory = isHistory === "true";
    const meds = await Medication.find(query);
    res.json(meds);
  } catch (err) {
    res.status(500).json({ message: "Error fetching medications" });
  }
});

app.put("/api/patients/:patientId/medications/move-to-history", async (req, res) => {
  try {
    const { medicationIds, medications } = req.body;
    if (!medicationIds || !Array.isArray(medicationIds)) return res.status(400).json({ message: "medicationIds array is required" });
    const prescriberMap = {};
    if (medications && Array.isArray(medications)) {
      medications.forEach((med) => { if (med.medId && med.presby) prescriberMap[med.medId] = med.presby; });
    }
    let modifiedCount = 0;
    for (const medId of medicationIds) {
      const updateData = { isHistory: true };
      const prescriber = prescriberMap[medId];
      if (prescriber && prescriber !== "N/A" && prescriber !== "") updateData.presby = prescriber;
      const result = await Medication.updateOne({ medId, patientId: req.params.patientId }, { $set: updateData });
      modifiedCount += result.modifiedCount;
    }
    res.json({ message: "✅ Medications moved to history", modifiedCount });
  } catch (err) {
    res.status(500).json({ message: "Error moving medications to history" });
  }
});

app.delete("/api/medications/:medId", async (req, res) => {
  try {
    await Medication.findOneAndDelete({ medId: req.params.medId });
    res.json({ message: "🗑️ Medication deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting medication" });
  }
});

app.put("/api/medications/:medId", async (req, res) => {
  try {
    const updated = await Medication.findOneAndUpdate(
      { medId: req.params.medId },
      { medicname: req.body.medicname, dosage: req.body.dosage, frequency: req.body.frequency, quantity: req.body.quantity, presby: req.body.presby, presNotes: req.body.presNotes, followup: req.body.followup ? new Date(req.body.followup) : null },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Medication not found" });
    res.json({ message: "✅ Medication updated successfully", medication: updated });
  } catch (err) {
    res.status(500).json({ message: "Error updating medication" });
  }
});

// ====== ALLERGIES SCHEMA ======
const allergySchema = new mongoose.Schema({
  allergyId: { type: String, unique: true },
  patientId: { type: String, required: true },
  allergen: String, severity: String, reaction: String, diadate: Date,
});
const Allergy = mongoose.model("Allergy", allergySchema);

async function generateAllergyId() {
  const last = await Allergy.findOne().sort({ _id: -1 });
  if (!last) return "A001";
  return "A" + (parseInt(last.allergyId.replace("A", "")) + 1).toString().padStart(3, "0");
}

app.post("/api/patients/:patientId/allergies", async (req, res) => {
  try {
    const allergy = new Allergy({ allergyId: await generateAllergyId(), patientId: req.params.patientId, allergen: req.body.allergen, severity: req.body.severity, reaction: req.body.reaction, diadate: req.body.diadate });
    await allergy.save();
    res.status(201).json({ message: "✅ Allergy saved successfully", allergy });
  } catch (err) {
    res.status(500).json({ message: "Error saving allergy" });
  }
});

app.get("/api/patients/:patientId/allergies", async (req, res) => {
  try {
    res.json(await Allergy.find({ patientId: req.params.patientId }));
  } catch (err) {
    res.status(500).json({ message: "Error fetching allergies" });
  }
});

app.delete("/api/allergies/:allergyId", async (req, res) => {
  try {
    await Allergy.findOneAndDelete({ allergyId: req.params.allergyId });
    res.json({ message: "🗑️ Allergy deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting allergy" });
  }
});

// ====== VITAL SIGNS SCHEMA ======
const vitalSignSchema = new mongoose.Schema({
  vitalId: { type: String, unique: true },
  patientId: { type: String, required: true },
  date: Date, heartrate: String, temp: String,
  weight: String, pressure: String, height: String, bmi: String,
});
const VitalSign = mongoose.model("VitalSign", vitalSignSchema);

async function generateVitalId() {
  const last = await VitalSign.findOne().sort({ _id: -1 });
  if (!last) return "V001";
  return "V" + (parseInt(last.vitalId.replace("V", "")) + 1).toString().padStart(3, "0");
}

app.post("/api/patients/:patientId/vitalsigns", async (req, res) => {
  try {
    const vital = new VitalSign({ vitalId: await generateVitalId(), patientId: req.params.patientId, date: req.body.date, heartrate: req.body.heartrate, temp: req.body.temp, weight: req.body.weight, pressure: req.body.pressure, height: req.body.height, bmi: req.body.bmi });
    await vital.save();
    res.status(201).json({ message: "✅ Vital sign record added successfully", vital });
  } catch (err) {
    res.status(500).json({ message: "Error saving vital sign" });
  }
});

app.get("/api/patients/:patientId/vitalsigns", async (req, res) => {
  try {
    res.json(await VitalSign.find({ patientId: req.params.patientId }));
  } catch (err) {
    res.status(500).json({ message: "Error fetching vitals" });
  }
});

app.delete("/api/vitalsigns/:vitalId", async (req, res) => {
  try {
    await VitalSign.findOneAndDelete({ vitalId: req.params.vitalId });
    res.json({ message: "🗑️ Vital sign record deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting vital sign" });
  }
});

// ══════════════════════════════════════════════════════════════════════
// ✅ AI VITAL STATUS ROUTE — Claude API proxy (safe, server-side)
// Requires ANTHROPIC_API_KEY in your .env file
// Called by vital_signs.js as: POST /api/ai/vital-status
// ══════════════════════════════════════════════════════════════════════
const AI_VITAL_PROMPTS = {
  heartrate: (v) =>
    `You are a clinical assistant. A patient's resting heart rate is ${v} bpm.
Normal adult range is 60–100 bpm. Bradycardia is below 60 bpm. Tachycardia is above 100 bpm.
Give ONE short clinical interpretation (max 12 words). Start with the correct emoji:
✅ normal  |  ⚠️ mild concern  |  🔴 moderate concern  |  🚨 urgent
Only output the single line. No extra text, no punctuation after.`,

  temperature: (v) =>
    `You are a clinical assistant. A patient's oral body temperature is ${v}°C.
Normal: 36.0–37.2°C | Low-grade fever: 37.3–37.9°C | Fever: 38.0–38.9°C | High fever: ≥39°C | Hypothermia: <36°C.
Give ONE short clinical interpretation (max 12 words). Start with the correct emoji:
✅ normal  |  🥶 hypothermia  |  🌡️ low-grade fever  |  🔥 fever  |  🚨 high fever
Only output the single line. No extra text.`,

  bloodpressure: (v) =>
    `You are a clinical assistant. A patient's blood pressure is ${v} mmHg.
AHA 2017: Normal <120/80 | Elevated 120-129/<80 | Stage 1 HTN 130-139/80-89 | Stage 2 HTN ≥140/≥90 | Crisis >180/>120 | Hypotension <90/60.
Give ONE short clinical interpretation (max 12 words). Start with the correct emoji:
✅ normal  |  🟡 elevated  |  🟠 Stage 1 HTN  |  🔴 Stage 2 HTN  |  🚨 crisis  |  🔵 hypotension
Only output the single line. No extra text.`,
};

app.post("/api/ai/vital-status", async (req, res) => {
  const { type, value } = req.body;

  if (!type || !value) {
    return res.status(400).json({ error: "Missing type or value" });
  }

  const promptFn = AI_VITAL_PROMPTS[type];
  if (!promptFn) {
    return res.status(400).json({ error: "Unknown vital type. Use: heartrate, temperature, bloodpressure" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ ANTHROPIC_API_KEY not set — AI vital status skipped");
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on server" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",  // fast + cheap for short labels
        max_tokens: 60,
        messages:   [{ role: "user", content: promptFn(value) }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Anthropic API error:", errText);
      return res.status(502).json({ error: "AI upstream error" });
    }

    const data   = await response.json();
    const result = data?.content?.[0]?.text?.trim() ?? "";
    console.log(`🤖 AI vital [${type}=${value}] → ${result}`);
    return res.json({ result });

  } catch (err) {
    console.error("❌ AI vital-status route error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

console.log("✅ AI vital-status route registered → POST /api/ai/vital-status");
// ══════════════════════════════════════════════════════════════════════

// ====== LAB RESULT SCHEMA ======
const labResultSchema = new mongoose.Schema(
  {
    patientId:    { type: String, default: null },
    patientName:  { type: String, required: true },
    testName:     { type: String, required: true },
    testDate:     { type: Date,   default: Date.now },
    notes:        { type: String, default: "" },
    fileName:     { type: String, default: "" },
    fileData:     { type: String, default: "" },
    fileType:     { type: String, default: "" },
    testType:     { type: String, default: "" },
    testData:     { type: mongoose.Schema.Types.Mixed, default: null },
    physician:    { type: String, default: "" },
    remarks:      { type: String, default: "" },
    uploadedBy:   { type: String, default: "Medical Technologist" },
    uploadedById: { type: String, default: null },
  },
  { timestamps: true, collection: "lab_results" }
);
const LabResult = mongoose.model("LabResult", labResultSchema);

app.post("/api/lab-results/upload", async (req, res) => {
  try {
    const { testName, patientName, patientId, testDate, notes, uploadedBy, uploadedById, fileName, fileData, fileType, testType, testData, physician, remarks } = req.body;
    if (!testName)    return res.status(400).json({ message: "Test name is required." });
    if (!patientName) return res.status(400).json({ message: "Patient name is required." });
    const labResult = new LabResult({ patientId: patientId || null, patientName, testName, testDate: testDate || new Date(), notes: notes || "", fileName: fileName || "", fileData: fileData || "", fileType: fileType || "", testType: testType || "", testData: testData || null, physician: physician || "", remarks: remarks || "", uploadedBy: uploadedBy || "Medical Technologist", uploadedById: uploadedById || null });
    await labResult.save();
    res.status(201).json({ message: "Lab result saved successfully.", labResult });
  } catch (err) {
    console.error("❌ Lab result save error:", err);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

app.get("/api/lab-results", async (req, res) => {
  try {
    const results = await LabResult.find({}, "-fileData").sort({ createdAt: -1 }).lean();
    res.json(results.map((r) => ({ id: r._id, testName: r.testName, testType: r.testType, patientName: r.patientName, patientId: r.patientId, testDate: r.testDate, notes: r.notes, remarks: r.remarks, physician: r.physician, uploadedBy: r.uploadedBy, uploadDate: r.createdAt, fileType: r.fileType, fileName: r.fileName })));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch lab results." });
  }
});

app.get("/api/lab-results/patient/:patientId", async (req, res) => {
  try {
    const results = await LabResult.find({ patientId: req.params.patientId }, "-fileData").sort({ createdAt: -1 }).lean();
    res.json(results.map((r) => ({ id: r._id, testName: r.testName, testType: r.testType, patientName: r.patientName, patientId: r.patientId, testDate: r.testDate, notes: r.notes, remarks: r.remarks, physician: r.physician, uploadedBy: r.uploadedBy, uploadDate: r.createdAt, fileType: r.fileType, fileName: r.fileName })));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch lab results." });
  }
});

app.get("/api/lab-results/:id", async (req, res) => {
  try {
    const result = await LabResult.findById(req.params.id).lean();
    if (!result) return res.status(404).json({ message: "Lab result not found." });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch lab result." });
  }
});

app.delete("/api-results/:id", async (req, res) => {
  try {
    const result = await LabResult.findById(req.params.id);
    if (!result) return res.status(404).json({ message: "Lab result not found." });
    await result.deleteOne();
    res.json({ message: "Lab result deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete lab result." });
  }
});

// ====== APPOINTMENT SCHEMA ======
const appointmentSchema = new mongoose.Schema({
  appointmentId: { type: String, unique: true },
  patientId: String, patientName: String,
  doctorId: String, doctorName: String,
  date: Date, time: String,
  duration: { type: Number, default: 30 },
  type: String, reason: String, notes: String, impression: String,
  status: { type: String, enum: ["Upcoming", "Ongoing", "Completed", "Canceled"], default: "Upcoming" },
  startedAt: Date, extendedMinutes: { type: Number, default: 0 },
});
const Appointment = mongoose.model("Appointment", appointmentSchema);

const archiveAppointmentSchema = new mongoose.Schema({
  archiveId: { type: String, unique: true },
  appointmentId: String, patientId: String, patientName: String,
  doctorId: String, doctorName: String,
  date: Date, time: String, duration: Number,
  type: String, reason: String, notes: String, status: String,
  startedAt: Date, completedAt: { type: Date, default: Date.now }, extendedMinutes: Number,
});
const ArchiveAppointment = mongoose.model("ArchiveAppointment", archiveAppointmentSchema);

async function generateAppointmentId() {
  try {
    const allActiveIds = await Appointment.find({}, { appointmentId: 1 });
    let maxNum = 0;
    for (const apt of allActiveIds) {
      if (apt.appointmentId && typeof apt.appointmentId === "string") {
        const num = parseInt(apt.appointmentId.replace(/^A/i, ""), 10);
        if (!isNaN(num) && num > 0) maxNum = Math.max(maxNum, num);
      }
    }
    return "A" + (maxNum + 1).toString().padStart(3, "0");
  } catch (err) {
    const count = await Appointment.countDocuments();
    return "A" + (count + 1).toString().padStart(3, "0");
  }
}

async function generateArchiveId() {
  const last = await ArchiveAppointment.findOne().sort({ _id: -1 });
  if (!last) return "AR001";
  return "AR" + (parseInt(last.archiveId.replace("AR", "")) + 1).toString().padStart(3, "0");
}

app.post("/api/appointments", async (req, res) => {
  try {
    const { patientId, patientName, doctorId, doctorName, date, time, duration, type, reason, notes } = req.body;
    const patient = await Patient.findOne({ patientId });
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    const doctor = await User.findOne({ userId: doctorId });
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    if (doctor.status === "Inactive") return res.status(400).json({ message: "Cannot schedule appointment. Doctor account is inactive." });
    const appointmentDate = new Date(date);
    const appointmentDuration = duration || 30;
    const [hours, minutes] = time.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + appointmentDuration;
    const existingAppointments = await Appointment.find({ patientId, date: { $gte: new Date(appointmentDate.setHours(0, 0, 0, 0)), $lt: new Date(appointmentDate.setHours(23, 59, 59, 999)) }, status: { $in: ["Upcoming", "Ongoing"] } });
    for (const existing of existingAppointments) {
      const [eH, eM] = existing.time.split(":").map(Number);
      const existingStart = eH * 60 + eM;
      const existingEnd = existingStart + (existing.duration || 30);
      if (startMinutes < existingEnd && endMinutes > existingStart) {
        const fmt = (m) => { const h = Math.floor(m / 60); const mn = m % 60; return `${h % 12 || 12}:${String(mn).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
        return res.status(409).json({ message: "Patient already has an appointment at this time", conflict: { patientName, requestedDoctor: doctorName, existingDoctor: existing.doctorName, date: appointmentDate.toLocaleDateString(), requestedTime: fmt(startMinutes), requestedEnd: fmt(endMinutes), existingTime: fmt(existingStart), existingEnd: fmt(existingEnd), existingAppointmentId: existing.appointmentId }, suggestion: "Please choose a different time slot." });
      }
    }
    const newId = await generateAppointmentId();
    const appointment = new Appointment({ appointmentId: newId, patientId, patientName, doctorId, doctorName, date: new Date(date), time: time || "09:00", duration: duration || 30, type, reason, notes, status: "Upcoming" });
    await appointment.save();
    if ((patient.status || "").toLowerCase() !== "active") {
      patient.status = "Active";
      await patient.save();
    }
    res.status(201).json({ message: "✅ Appointment scheduled successfully", appointment });
  } catch (err) {
    console.error("Error scheduling appointment:", err);
    res.status(500).json({ message: "Error scheduling appointment" });
  }
});

app.get("/api/appointments", async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    await Appointment.deleteMany({ date: { $lt: today }, status: { $in: ["Completed", "Canceled"] } });
    const appointments = await Appointment.find();
    for (const apt of appointments) {
      const aptDateStr = new Date(apt.date).toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];
      if (aptDateStr === todayStr && apt.status === "Upcoming") {
        const [h, m] = apt.time.split(":").map(Number);
        if (currentMinutes >= h * 60 + m) { apt.status = "Ongoing"; apt.startedAt = new Date(); await apt.save(); }
      }
    }
    res.json(await Appointment.find());
  } catch (err) {
    res.status(500).json({ message: "Error fetching appointments" });
  }
});

app.get("/api/appointments/:appointmentId", async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ appointmentId: req.params.appointmentId });
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ message: "Error fetching appointment" });
  }
});

app.put("/api/appointments/:appointmentId", async (req, res) => {
  try {
    const { patientName, doctorId, doctorName, date, time, type, duration, reason, notes, impression } = req.body;
    const updated = await Appointment.findOneAndUpdate({ appointmentId: req.params.appointmentId }, { patientName, doctorId, doctorName, date: new Date(date), time, type, duration, reason, notes, impression }, { new: true });
    if (!updated) return res.status(404).json({ message: "Appointment not found" });
    res.json({ message: "✅ Appointment updated successfully", appointment: updated });
  } catch (err) {
    res.status(500).json({ message: "Error updating appointment" });
  }
});

app.put("/api/appointments/:appointmentId/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Upcoming", "Completed", "Canceled"].includes(status)) return res.status(400).json({ message: "Invalid status value" });
    const appointment = await Appointment.findOne({ appointmentId: req.params.appointmentId });
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    appointment.status = status;
    await appointment.save();
    if (status === "Completed") {
      try {
        const billingAddUrl = buildBillingUrl("/api/billing/add");
        if (billingAddUrl) {
          await fetch(billingAddUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.BILLING_API_KEY}` }, body: JSON.stringify({ appointmentId: appointment.appointmentId, patientId: appointment.patientId, patientName: appointment.patientName, doctorId: appointment.doctorId, doctorName: appointment.doctorName, service: appointment.type, date: appointment.date, price: appointment.price || 0 }) });
        }
      } catch (billingErr) { console.error("❌ Failed to send to Billing:", billingErr); }
    }
    res.json({ message: "✅ Appointment status updated successfully", appointment });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/appointments/:appointmentId/extend", async (req, res) => {
  try {
    const { additionalMinutes } = req.body;
    if (!additionalMinutes || additionalMinutes <= 0) return res.status(400).json({ message: "Invalid extension time" });
    const appointment = await Appointment.findOne({ appointmentId: req.params.appointmentId });
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    appointment.extendedMinutes += Number(additionalMinutes);
    await appointment.save();
    res.json({ message: `✅ Appointment extended by ${additionalMinutes} minutes`, appointment });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/appointments/:appointmentId/start", async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndUpdate({ appointmentId: req.params.appointmentId }, { status: "Ongoing", startedAt: new Date() }, { new: true });
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    res.json({ message: "✅ Appointment started", appointment });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/appointments/:appointmentId/archive", async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ appointmentId: req.params.appointmentId });
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    const archived = new ArchiveAppointment({ archiveId: await generateArchiveId(), appointmentId: appointment.appointmentId, patientId: appointment.patientId, patientName: appointment.patientName, doctorId: appointment.doctorId, doctorName: appointment.doctorName, date: appointment.date, time: appointment.time, duration: appointment.duration, type: appointment.type, reason: appointment.reason, notes: appointment.notes, status: appointment.status, startedAt: appointment.startedAt, extendedMinutes: appointment.extendedMinutes });
    await archived.save();
    await appointment.deleteOne();
    res.json({ message: "✅ Appointment completed and archived", archived });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/appointments/archive/list", async (req, res) => {
  try {
    res.json(await ArchiveAppointment.find().sort({ completedAt: -1 }));
  } catch (err) {
    res.status(500).json({ message: "Error fetching archived appointments" });
  }
});

// ====== BACKUP LOG SCHEMA ======
const backupLogSchema = new mongoose.Schema({
  backupId: { type: String, unique: true },
  type: { type: String, enum: ["Manual", "Automatic"] },
  category: String, scope: String,
  status: { type: String, enum: ["success", "failed"], default: "success" },
  records: Number, activeCount: Number, archivedCount: Number,
  size: String, duration: String, details: String,
  timestamp: { type: Date, default: Date.now },
  data: { users: [Object], patients: [Object], activeAppointments: [Object], archivedAppointments: [Object], activityLogs: [Object] },
});
const BackupLog = mongoose.model("BackupLog", backupLogSchema);

async function generateBackupId() {
  const last = await BackupLog.findOne().sort({ _id: -1 });
  if (!last) return "B001";
  return "B" + (parseInt(last.backupId.replace("B", "")) + 1).toString().padStart(3, "0");
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

// ====== ACTIVITY LOG ROUTES ======
app.post("/api/activity/log", async (req, res) => {
  try {
    const { userId, userName, userRole, action, details, ipAddress } = req.body;
    const logId = await generateActivityLogId();
    const activityLog = new ActivityLog({ logId, userId, userName, userRole, action, details, ipAddress });
    await activityLog.save();
    res.json({ message: "✅ Activity logged successfully", log: activityLog });
  } catch (err) {
    res.status(500).json({ message: "Error logging activity" });
  }
});

app.get("/api/activity/logs", async (req, res) => {
  try {
    res.json(await ActivityLog.find({}).sort({ timestamp: -1 }));
  } catch (err) {
    res.status(500).json({ message: "Error fetching activity logs" });
  }
});

// ====== BACKUP ROUTES ======
app.get("/api/backup/accounts/stats", async (req, res) => {
  try {
    const users = await User.find({});
    const patients = await Patient.find({});
    const latestBackup = await BackupLog.findOne({ category: "Users & Patients" }).sort({ timestamp: -1 });
    res.json({ totalUsers: users.length, totalPatients: patients.length, totalRecords: users.length + patients.length, lastBackup: latestBackup ? latestBackup.timestamp : null });
  } catch (err) {
    res.status(500).json({ message: "Error fetching stats" });
  }
});

app.get("/api/backup/logs/accounts", async (req, res) => {
  try {
    const logs = await BackupLog.find({ category: "Users & Patients" }).sort({ timestamp: -1 });
    res.json(logs.map((log) => ({ id: log._id.toString(), status: log.status, date: log.timestamp, type: log.type, category: log.category, records: log.records, size: log.size, duration: log.duration, details: log.details })));
  } catch (err) {
    res.status(500).json({ message: "Error fetching logs" });
  }
});

app.get("/api/backup/logs/appointments", async (req, res) => {
  try {
    const logs = await BackupLog.find({ category: { $regex: /Appointment/i } }).sort({ timestamp: -1 });
    res.json(logs.map((log) => ({ id: log._id.toString(), status: log.status, date: log.timestamp, type: log.type, category: log.category, scope: log.scope || "Full", records: log.records, activeCount: log.activeCount || 0, archivedCount: log.archivedCount || 0, size: log.size, duration: log.duration, details: log.details })));
  } catch (err) {
    res.status(500).json({ message: "Error fetching logs" });
  }
});

app.get("/api/backup/logs/activity", async (req, res) => {
  try {
    const logs = await BackupLog.find({ category: { $regex: /Activity/i } }).sort({ timestamp: -1 });
    res.json(logs.map((log) => ({ id: log._id.toString(), status: log.status, date: log.timestamp, type: log.type, category: log.category || "Activity Logs", records: log.records, size: log.size, duration: log.duration, details: log.details })));
  } catch (err) {
    res.status(500).json({ message: "Error fetching logs" });
  }
});

app.get("/api/backup/logs/:id", async (req, res) => {
  try {
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) return res.status(400).json({ message: "Invalid backup ID format" });
    const log = await BackupLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Backup not found" });
    res.json({ id: log._id.toString(), backupId: log.backupId, type: log.type, category: log.category, status: log.status, records: log.records, size: log.size, duration: log.duration, details: log.details, timestamp: log.timestamp, data: log.data, scope: log.scope, activeCount: log.activeCount, archivedCount: log.archivedCount });
  } catch (err) {
    res.status(500).json({ message: "Error fetching backup details" });
  }
});

app.get("/api/backup/download/:id", async (req, res) => {
  try {
    const log = await BackupLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Backup not found" });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=backup_${log.backupId}_${log.timestamp.toISOString().split("T")[0]}.json`);
    res.json({ backupId: log.backupId, timestamp: log.timestamp, category: log.category, type: log.type, records: log.records, data: log.data });
  } catch (err) {
    res.status(500).json({ message: "Error downloading backup" });
  }
});

app.post("/api/backup/accounts/manual", async (req, res) => {
  try {
    const users = await User.find({}, "-password").lean();
    const patients = await Patient.find({}).lean();
    const totalRecords = users.length + patients.length;
    const sizeInBytes = Buffer.byteLength(JSON.stringify({ users, patients }), "utf8");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const backupLog = new BackupLog({ backupId: await generateBackupId(), type: "Manual", category: "Users & Patients", status: "success", records: totalRecords, size: formatFileSize(sizeInBytes), duration: "2m 15s", details: `Backed up ${users.length} users and ${patients.length} patients successfully.`, timestamp: new Date(), data: { users, patients } });
    await backupLog.save();
    res.json({ message: "✅ Manual backup completed successfully", backup: { id: backupLog._id.toString(), status: backupLog.status, date: backupLog.timestamp, type: backupLog.type, category: backupLog.category, records: backupLog.records, size: backupLog.size, duration: backupLog.duration, details: backupLog.details } });
  } catch (err) {
    res.status(500).json({ message: "Backup failed", error: err.message });
  }
});

app.get("/api/backup/appointments/stats", async (req, res) => {
  try {
    const activeAppointments = await Appointment.find({});
    const archivedAppointments = await ArchiveAppointment.find({});
    const latestBackup = await BackupLog.findOne({ category: { $regex: /Appointment/i } }).sort({ timestamp: -1 });
    res.json({ totalActive: activeAppointments.length, totalArchived: archivedAppointments.length, totalRecords: activeAppointments.length + archivedAppointments.length, breakdown: { upcoming: activeAppointments.filter((a) => a.status === "Upcoming").length, ongoing: activeAppointments.filter((a) => a.status === "Ongoing").length, completed: archivedAppointments.filter((a) => a.status === "Completed").length, canceled: archivedAppointments.filter((a) => a.status === "Canceled").length }, lastBackup: latestBackup ? latestBackup.timestamp : null });
  } catch (err) {
    res.status(500).json({ message: "Error fetching stats" });
  }
});

app.post("/api/backup/appointments/manual", async (req, res) => {
  try {
    const { scope } = req.body;
    let activeAppointments = [], archivedAppointments = [], scopeLabel = "Full";
    if (!scope || scope === "full") { activeAppointments = await Appointment.find({}).lean(); archivedAppointments = await ArchiveAppointment.find({}).lean(); }
    else if (scope === "active") { activeAppointments = await Appointment.find({}).lean(); scopeLabel = "Active Only"; }
    else if (scope === "archived") { archivedAppointments = await ArchiveAppointment.find({}).lean(); scopeLabel = "Archived Only"; }
    const dataToBackup = { activeAppointments, archivedAppointments };
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const backupLog = new BackupLog({ backupId: await generateBackupId(), type: "Manual", category: `Appointments (${scopeLabel})`, scope: scopeLabel, status: "success", records: activeAppointments.length + archivedAppointments.length, activeCount: activeAppointments.length, archivedCount: archivedAppointments.length, size: formatFileSize(Buffer.byteLength(JSON.stringify(dataToBackup), "utf8")), duration: "2m 10s", details: `Backed up ${activeAppointments.length} active and ${archivedAppointments.length} archived appointments.`, timestamp: new Date(), data: dataToBackup });
    await backupLog.save();
    res.json({ message: "✅ Appointment backup completed successfully", backup: { id: backupLog._id.toString(), status: backupLog.status, date: backupLog.timestamp, type: backupLog.type, category: backupLog.category, scope: backupLog.scope, records: backupLog.records, activeCount: backupLog.activeCount, archivedCount: backupLog.archivedCount, size: backupLog.size, duration: backupLog.duration, details: backupLog.details } });
  } catch (err) {
    res.status(500).json({ message: "Appointment backup failed", error: err.message });
  }
});

app.get("/api/backup/activity/stats", async (req, res) => {
  try {
    const activityLogs = await ActivityLog.find({});
    const today = new Date(); today.setHours(0, 0, 0, 0);
    res.json({ totalLogs: activityLogs.length, todayLogs: activityLogs.filter((log) => new Date(log.timestamp) >= today).length, lastBackup: new Date() });
  } catch (err) {
    res.status(500).json({ message: "Error fetching activity stats" });
  }
});

app.post("/api/backup/activity/manual", async (req, res) => {
  try {
    const activityLogs = await ActivityLog.find({}).lean();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const backupLog = new BackupLog({ backupId: await generateBackupId(), type: "Manual", category: "Activity Logs", scope: "Full", status: "success", records: activityLogs.length, activeCount: 0, archivedCount: 0, size: formatFileSize(Buffer.byteLength(JSON.stringify({ activityLogs }), "utf8")), duration: "1m 45s", details: `Backed up ${activityLogs.length} activity log entries successfully.`, timestamp: new Date(), data: { users: [], patients: [], activeAppointments: [], archivedAppointments: [], activityLogs } });
    await backupLog.save();
    res.json({ message: "✅ Activity log backup completed successfully", backup: { id: backupLog._id.toString(), status: backupLog.status, date: backupLog.timestamp, type: backupLog.type, category: backupLog.category, records: backupLog.records, size: backupLog.size, duration: backupLog.duration, details: backupLog.details } });
  } catch (err) {
    res.status(500).json({ message: "Activity log backup failed", error: err.message });
  }
});

app.get("/api/backup/settings", (req, res) => {
  res.json({ appointment: { frequency: 1, unit: "days" }, account: { frequency: 1, unit: "days" }, activity: { frequency: 7, unit: "days" }, enableNotifications: true, enableFailureAlerts: true, enableRetention: true });
});

app.post("/api/backup/settings", (req, res) => {
  scheduleBackups(req.body);
  res.json({ message: "✅ Backup settings saved and scheduler updated", settings: req.body });
});

const requestFormSchema = new mongoose.Schema({
  requestId:         { type: String,   required: true, unique: true },
  patientID:         { type: String,   required: true },
  patientName:       { type: String,   required: true },
  patientFirstName:  { type: String },
  patientMiddleName: { type: String },
  patientLastName:   { type: String },
  patientAge:        { type: Number },
  patientSex:        { type: String },
  patientDOB:        { type: String },
  referringDoctor:   { type: String },
  submittedBy:       { type: String },
  submittedAt:       { type: Date,     default: Date.now },
  priority:          { type: String,   enum: ["Routine", "Urgent", "Emergency"], default: "Routine" },
  tests:             { type: [String], default: [] },
  notes:             { type: String,   default: "" },
  status: { type: String, enum: ["Pending", "Approved", "Rejected", "In Progress", "Completed"], default: "Pending" },
  completedAt:  { type: Date },
  completedBy:  { type: String },
  updatedAt:    { type: Date },
});
const RequestForm = mongoose.model("RequestForm", requestFormSchema);

async function generateRequestFormId() {
  const today = new Date();
  const dateStr = today.getFullYear().toString() + String(today.getMonth() + 1).padStart(2, "0") + String(today.getDate()).padStart(2, "0");
  const count = await RequestForm.countDocuments();
  const seq = String(count + 1).padStart(4, "0");
  return `RF-${dateStr}-${seq}`;
}

app.post("/api/request-forms", async (req, res) => {
  try {
    const { patientID, patientName, patientFirstName, patientMiddleName, patientLastName, patientAge, patientSex, patientDOB, referringDoctor, submittedBy, priority, tests, notes } = req.body;
    if (!patientID || !patientName) return res.status(400).json({ message: "Missing required fields." });
    if (!Array.isArray(tests) || tests.length === 0) return res.status(400).json({ message: "Please select at least one laboratory test." });
    const newRequest = new RequestForm({ requestId: await generateRequestFormId(), patientID, patientName, patientFirstName, patientMiddleName, patientLastName, patientAge, patientSex, patientDOB, referringDoctor, submittedBy, priority: priority || "Routine", tests, notes: notes || "", status: "Pending", submittedAt: new Date() });
    await newRequest.save();
    res.status(201).json({ message: "Request submitted successfully.", requestId: newRequest.requestId });
  } catch (err) {
    console.error("Error saving request form:", err);
    res.status(500).json({ message: "Failed to submit request." });
  }
});

app.get("/api/request-forms", async (req, res) => {
  try {
    const query = {};
    if (req.query.status && req.query.status !== "all") query.status = req.query.status;
    const requests = await RequestForm.find(query).sort({ submittedAt: -1 }).lean();
    res.json(requests);
  } catch (err) {
    console.error("Error fetching request forms:", err);
    res.status(500).json({ message: "Failed to fetch request forms." });
  }
});

app.get("/api/request-forms/:requestId", async (req, res) => {
  try {
    const request = await RequestForm.findOne({ requestId: req.params.requestId }).lean();
    if (!request) return res.status(404).json({ message: "Request not found." });
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch request." });
  }
});

app.put("/api/request-forms/:requestId/status", async (req, res) => {
  try {
    const updated = await RequestForm.findOneAndUpdate({ requestId: req.params.requestId }, { $set: { status: req.body.status, updatedAt: new Date() } }, { new: true });
    if (!updated) return res.status(404).json({ message: "Request not found." });
    res.json({ message: "Status updated.", request: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update status." });
  }
});

app.put("/api/request-forms/:requestId/complete", async (req, res) => {
  try {
    const { completedBy } = req.body;
    const updated = await RequestForm.findOneAndUpdate({ requestId: req.params.requestId }, { $set: { status: "Completed", completedAt: new Date(), completedBy: completedBy || "Medical Technologist", updatedAt: new Date() } }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Request not found." });
    res.json({ success: true, message: "Request marked as completed.", request: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark request as completed." });
  }
});

app.patch("/api/request-forms/:requestId", async (req, res) => {
  try {
    const updated = await RequestForm.findOneAndUpdate({ requestId: req.params.requestId }, { $set: { ...req.body, updatedAt: new Date() } }, { new: true });
    if (!updated) return res.status(404).json({ message: "Request not found." });
    res.json({ message: "Request updated.", request: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update request." });
  }
});

// ====== SYSTEM STATUS ======
app.get("/api/emr/status", (req, res) => res.json({ connected: true }));
app.get("/api/pharmacy/status", (req, res) => res.json({ connected: false }));
app.get("/api/billing/status", (req, res) => res.json({ connected: false }));

// ====== BACKUP SCHEDULER ======
let backupIntervals = { appointment: null, account: null, activity: null };

async function scheduleBackups(settings) {
  Object.values(backupIntervals).forEach((interval) => { if (interval) clearInterval(interval); });
  if (settings.appointment) {
    backupIntervals.appointment = setInterval(async () => {
      try {
        const activeAppointments = await Appointment.find({}).lean();
        const archivedAppointments = await ArchiveAppointment.find({}).lean();
        const dataToBackup = { activeAppointments, archivedAppointments };
        await new BackupLog({ backupId: await generateBackupId(), type: "Automatic", category: "Appointments (Full)", scope: "Full", status: "success", records: activeAppointments.length + archivedAppointments.length, activeCount: activeAppointments.length, archivedCount: archivedAppointments.length, size: formatFileSize(Buffer.byteLength(JSON.stringify(dataToBackup), "utf8")), duration: "2m 5s", details: `Automatic backup: ${activeAppointments.length} active and ${archivedAppointments.length} archived appointments.`, timestamp: new Date(), data: dataToBackup }).save();
      } catch (err) { console.error("❌ Automatic appointment backup failed:", err); }
    }, convertToMilliseconds(settings.appointment.frequency, settings.appointment.unit));
  }
  if (settings.account) {
    setTimeout(() => {
      backupIntervals.account = setInterval(async () => {
        try {
          const users = await User.find({}, "-password").lean();
          const patients = await Patient.find({}).lean();
          const dataToBackup = { users: users || [], patients: patients || [], activeAppointments: [], archivedAppointments: [] };
          await new BackupLog({ backupId: await generateBackupId(), type: "Automatic", category: "Users & Patients", scope: "N/A", status: "success", records: users.length + patients.length, activeCount: 0, archivedCount: 0, size: formatFileSize(Buffer.byteLength(JSON.stringify(dataToBackup), "utf8")), duration: "2m 5s", details: `Automatic backup: ${users.length} users and ${patients.length} patients.`, timestamp: new Date(), data: dataToBackup }).save();
        } catch (err) { console.error("❌ Automatic account backup failed:", err.message); }
      }, convertToMilliseconds(settings.account.frequency, settings.account.unit));
    }, 1000);
  }
  if (settings.activity) {
    setTimeout(() => {
      backupIntervals.activity = setInterval(async () => {
        try {
          const activityLogs = await ActivityLog.find({}).lean();
          const dataToBackup = { users: [], patients: [], activeAppointments: [], archivedAppointments: [], activityLogs };
          await new BackupLog({ backupId: await generateBackupId(), type: "Automatic", category: "Activity Logs", scope: "Full", status: "success", records: activityLogs.length, activeCount: 0, archivedCount: 0, size: formatFileSize(Buffer.byteLength(JSON.stringify(dataToBackup), "utf8")), duration: "1m 40s", details: `Automatic backup: ${activityLogs.length} activity log entries.`, timestamp: new Date(), data: dataToBackup }).save();
        } catch (err) { console.error("❌ Automatic activity log backup failed:", err.message); }
      }, convertToMilliseconds(settings.activity.frequency, settings.activity.unit));
    }, 2000);
  }
}

function convertToMilliseconds(frequency, unit) {
  const multipliers = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000, months: 2592000000, years: 31536000000 };
  return frequency * (multipliers[unit] || multipliers.days);
}

// ====== NOTIFICATION ROUTES ======
app.post("/api/notifications", async (req, res) => {
  try {
    const normalizedRole = normalizeRole(req.body.recipientRole);
    const normalizedRecipientId = await resolveRecipientUserId(req.body.recipientId);
    const payload = { ...req.body, recipientRole: normalizedRole, recipientId: normalizedRecipientId };
    const notification = await Notification.createNotification(payload);
    if (notification.recipientId) { emitToUser(notification.recipientId, "new_notification", notification); }
    else { emitToRole(notification.recipientRole, "new_notification", notification); }
    res.status(201).json({ success: true, message: "Notification created", notification });
  } catch (err) {
    console.error("Error creating notification:", err);
    res.status(500).json({ success: false, message: "Failed to create notification" });
  }
});

app.get("/api/notifications/my", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const normalizedRole = normalizeRole(role);
    if (!userId || !normalizedRole) return res.status(400).json({ message: "userId and role required" });
    const notifications = await Notification.find({ $or: [{ recipientId: userId }, { recipientRole: normalizedRole, recipientId: null }], status: { $in: ["unread", "read"] } }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
});

app.get("/api/notifications/count", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const normalizedRole = normalizeRole(role);
    if (!userId || !normalizedRole) return res.status(400).json({ message: "userId and role required" });
    const count = await Notification.countDocuments({ $or: [{ recipientId: userId }, { recipientRole: normalizedRole, recipientId: null }], status: "unread" });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, count: 0 });
  }
});

app.put("/api/notifications/:id/read", async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    await notification.markAsRead();
    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
});

app.put("/api/notifications/:id/handle", async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    await notification.markAsHandled();
    emitToRole(notification.recipientRole, "notification_handled", { notificationId: notification._id });
    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark as handled" });
  }
});

app.delete("/api/notifications/clear", async (req, res) => {
  try {
    const { userId, role } = req.body;
    const normalizedRole = normalizeRole(role);
    if (!userId || !normalizedRole) return res.status(400).json({ message: "userId and role required" });
    await Notification.updateMany({ $or: [{ recipientId: userId }, { recipientRole: normalizedRole, recipientId: null }], status: { $in: ["unread", "read"] } }, { $set: { status: "handled", handledAt: new Date() } });
    res.json({ success: true, message: "All notifications cleared" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to clear notifications" });
  }
});

app.post("/api/notifications/lab-request", async (req, res) => {
  try {
    const { requestId, patientName, doctorName, doctorId, tests, priority } = req.body;
    const notification = await Notification.createNotification({ type: "lab_request", recipientRole: "Medtech", recipientId: null, senderId: doctorId || "system", senderName: doctorName || "Doctor", senderRole: "Doctor", title: "🧪 New Lab Request", message: `New lab request for ${patientName} (${tests?.slice(0, 2)?.join(", ") || "Lab Test"})`, patientName, doctorName, requestId, data: { tests, priority }, priority: priority === "Urgent" || priority === "Emergency" ? "high" : "normal" });
    emitToRole("Medtech", "new_notification", notification);
    res.status(201).json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/notifications/doctor-enter", async (req, res) => {
  try {
    const { appointmentId, patientName, doctorName, doctorId } = req.body;
    const notification = await Notification.createNotification({ type: "doctor_enter", recipientRole: "Nurse", recipientId: null, senderId: doctorId || "system", senderName: doctorName, senderRole: "Doctor", title: "Doctor Consultation Request", message: `Dr. ${doctorName} is ready to consult with ${patientName}`, appointmentId, patientName, doctorId, doctorName, data: { appointmentId, patientName, doctorId, doctorName } });
    emitToRole("Nurse", "new_notification", notification);
    res.status(201).json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/notifications/appointment-time", async (req, res) => {
  try {
    const { appointmentId, patientName, doctorName, doctorId, time } = req.body;
    const existingNotification = await Notification.findOne({ type: "appointment_time_arrived", appointmentId, status: { $in: ["unread", "read"] } }).lean();
    if (existingNotification) return res.status(200).json({ success: true, notification: existingNotification, deduped: true });
    const notification = await Notification.createNotification({ type: "appointment_time_arrived", recipientRole: "Nurse", recipientId: null, senderId: "system", senderName: "System", senderRole: "System", title: "Appointment Time Arrived", message: `Appointment for ${patientName} with ${doctorName} is due now`, appointmentId, patientName, doctorId, doctorName, data: { appointmentId, patientName, doctorId, doctorName, time } });
    emitToRole("Nurse", "new_notification", notification);
    res.status(201).json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/notifications/nurse-response", async (req, res) => {
  try {
    const { appointmentId, patientName, status, doctorId } = req.body;
    const resolvedDoctorRecipientId = await resolveRecipientUserId(doctorId);
    const notification = await Notification.createNotification({ type: "nurse_response", recipientRole: "Doctor", recipientId: resolvedDoctorRecipientId, senderId: req.body.nurseId || "system", senderName: req.body.nurseName || "Nurse", senderRole: "Nurse", title: status === "ongoing" ? "Patient Present" : "Appointment Canceled", message: status === "ongoing" ? `Patient ${patientName} is present. Appointment is now Ongoing.` : `Patient ${patientName} is not present. Appointment has been canceled.`, appointmentId, patientName, doctorId: resolvedDoctorRecipientId || doctorId, data: { appointmentId, patientName, status } });
    if (resolvedDoctorRecipientId) { emitToUser(resolvedDoctorRecipientId, "new_notification", notification); }
    else { emitToRole("Doctor", "new_notification", notification); }
    res.status(201).json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

console.log("✅ Notification routes registered");

// ====== START SERVER ======
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);
  socket.on("register", (userId) => {
    connectedUsers.set(userId, socket.id);
    console.log(`✅ User ${userId} registered with socket ${socket.id}`);
  });
  socket.on("disconnect", () => {
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) { connectedUsers.delete(userId); break; }
    }
  });
});

function emitToRole(role, event, data) {
  io.emit(`notification:${role}`, { event, data });
  console.log(`📢 Emitted ${event} to all ${role}s`);
}

function emitToUser(userId, event, data) {
  const socketId = connectedUsers.get(userId);
  if (socketId) { io.to(socketId).emit("notification", { event, data }); return true; }
  return false;
}

global.io = io;
global.emitToRole = emitToRole;
global.emitToUser = emitToUser;

function parseAppointmentTime(timeValue) {
  const raw = String(timeValue || "").trim();
  if (!raw) return null;
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":").map(Number);
    if (!Number.isNaN(h) && !Number.isNaN(m)) return { hours: h, minutes: m };
  }
  const match12 = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = Number(match12[1]);
    const minutes = Number(match12[2]);
    const meridiem = match12[3].toUpperCase();
    if (hours === 12) hours = 0;
    if (meridiem === "PM") hours += 12;
    return { hours, minutes };
  }
  return null;
}

async function scanUpcomingAppointmentTimes() {
  try {
    const now = new Date();
    const upcomingAppointments = await Appointment.find({ status: { $in: ["Upcoming", "Ongoing"] } }).lean();
    if (!upcomingAppointments.length) return;
    const dueAppointments = upcomingAppointments.filter((appointment) => {
      if (!appointment?.date || !appointment?.time) return false;
      const parsedTime = parseAppointmentTime(appointment.time);
      if (!parsedTime) return false;
      const schedule = new Date(appointment.date);
      if (Number.isNaN(schedule.getTime())) return false;
      schedule.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
      const nowAtMinute = new Date(now);
      nowAtMinute.setSeconds(0, 0);
      return now.getSeconds() === 0 && schedule.getTime() === nowAtMinute.getTime();
    });
    if (!dueAppointments.length) return;
    const appointmentIds = dueAppointments.map((a) => a.appointmentId).filter(Boolean);
    if (!appointmentIds.length) return;
    const existing = await Notification.find({ type: "appointment_time_arrived", appointmentId: { $in: appointmentIds }, status: { $in: ["unread", "read"] } }, { appointmentId: 1 }).lean();
    const existingIds = new Set(existing.map((n) => n.appointmentId));
    for (const appointment of dueAppointments) {
      if (!appointment.appointmentId || existingIds.has(appointment.appointmentId)) continue;
      const notification = await Notification.createNotification({ type: "appointment_time_arrived", recipientRole: "Nurse", recipientId: null, senderId: "system", senderName: "System", senderRole: "System", title: "Appointment Time Arrived", message: `Appointment for ${appointment.patientName} with ${appointment.doctorName} is due now`, appointmentId: appointment.appointmentId, patientName: appointment.patientName, doctorId: appointment.doctorId, doctorName: appointment.doctorName, data: { appointmentId: appointment.appointmentId, patientName: appointment.patientName, doctorId: appointment.doctorId, doctorName: appointment.doctorName, time: appointment.time } });
      emitToRole("Nurse", "new_notification", notification);
      existingIds.add(appointment.appointmentId);
    }
  } catch (err) {
    console.error("Error scanning appointment-time notifications:", err);
  }
}

setInterval(scanUpcomingAppointmentTimes, 1000);
setTimeout(scanUpcomingAppointmentTimes, 5000);

httpServer.listen(PORT, () => {
  console.log(`🚀 EMR Server running on port ${PORT}`);
  console.log(`🔌 Socket.io server ready`);
});