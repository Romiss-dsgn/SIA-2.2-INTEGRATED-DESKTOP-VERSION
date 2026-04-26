// models/PatientModel.js
import mongoose from "mongoose";

const patientSchema = new mongoose.Schema({
  patientId: { type: String, required: true, unique: true },
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  dob: { type: Date },
  gender: { type: String },
  status: { type: String, default: "active" },
}, { timestamps: true });

// Prevent OverwriteModelError
const PatientModel = mongoose.models.PatientModel || mongoose.model("PatientModel", patientSchema);

export default PatientModel;