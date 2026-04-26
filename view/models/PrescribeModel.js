// models/PrescribeModel.js
import mongoose from "mongoose";

const prescribeSchema = new mongoose.Schema({
  medId: { type: String, unique: true },
  patientId: { type: String, required: true },
  medicname: String,
  strength: { type: String },
  dosage: String,
  frequency: String,
  // --- ADD THESE FIELDS ---
  durationDays: { type: Number, default: 0 },
  durationMaintain: { type: Boolean, default: false },
  // -------------------------
  quantity: { type: Number, default: 0 },
  presby: String,
  presNotes: String,
  followup: Date,
}, { timestamps: true }); // Optional: adds createdAt and updatedAt

const Prescribe = mongoose.models.Prescribe || mongoose.model("Prescribe", prescribeSchema);

export default Prescribe;