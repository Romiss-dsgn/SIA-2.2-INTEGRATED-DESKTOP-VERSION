// models/MedicineModel.js
import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  strength: { type: String },
  type: { type: String },
  requiresPrescription: { type: Boolean, default: false },
}, { timestamps: true });

const MedicineModel = mongoose.models.MedicineModel || mongoose.model("MedicineModel", medicineSchema);

export default MedicineModel;